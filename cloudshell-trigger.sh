#!/bin/bash

FUNCTION_NAME="auto-tweet"  # Updated to exact Lambda function name
REGION="ap-south-1"        # Replace with your AWS region

function invoke_lambda() {
    local action=$1
    local payload=""
    
    case $action in
        "generate")
            payload='{"forceGenerate": true}'
            ;;
        "post")
            payload='{"manualPost": true}'
            ;;
        "both")
            payload='{"forceGenerate": true, "manualPost": true}'
            ;;
        *)
            echo "Invalid action. Use: generate, post, or both"
            exit 1
            ;;
    esac

    echo "Invoking Lambda function with action: $action"
    aws lambda invoke \
        --function-name $FUNCTION_NAME \
        --region $REGION \
        --payload "$payload" \
        --cli-binary-format raw-in-base64-out \
        response.json

    echo "Response:"
    cat response.json
    rm response.json
}

function view_status() {
    echo "Reading tweets.json..."
    cat ./tweets.json | jq '.'

    echo -e "\nChecking CloudWatch Logs (last 5 minutes)..."
    aws logs get-log-events \
        --log-group-name "/aws/lambda/auto-tweet" \  # Updated log group name
        --log-stream-name $(aws logs describe-log-streams \
            --log-group-name "/aws/lambda/auto-tweet" \  # Updated log group name
            --order-by LastEventTime \
            --descending \
            --limit 1 \
            --query 'logStreams[0].logStreamName' \
            --output text) \
        --start-time $(( $(date +%s) - 300 ))000 \
        --query 'events[*].message' \
        --output text
}

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: ./cloudshell-trigger.sh [generate|post|both|status]"
    echo "  generate - Generate new tweets for today"
    echo "  post    - Post the next scheduled tweet"
    echo "  both    - Generate and post tweets"
    echo "  status  - View scheduled tweets and recent logs"
    exit 1
fi

case $1 in
    "status")
        view_status
        ;;
    *)
        invoke_lambda $1
        ;;
esac
