#!/bin/bash

FUNCTION_NAME="AutoTweet"  # Replace with your Lambda function name
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

# Show usage if no arguments provided
if [ $# -eq 0 ]; then
    echo "Usage: ./cloudshell-trigger.sh [generate|post|both]"
    echo "  generate - Generate new tweets for today"
    echo "  post    - Post the next scheduled tweet"
    echo "  both    - Generate and post tweets"
    exit 1
fi

invoke_lambda $1
