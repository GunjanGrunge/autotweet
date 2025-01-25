# AutoTweet

## CloudShell Usage

1. Open AWS CloudShell in your browser
2. Run the following commands:
```bash
chmod +x cloudshell-trigger.sh
./cloudshell-trigger.sh generate  # Generate new tweets
./cloudshell-trigger.sh post      # Post next scheduled tweet
./cloudshell-trigger.sh both      # Do both
./cloudshell-trigger.sh status    # Check status and scheduled tweets
```

## Setup Requirements

1. Add these secrets to your GitHub repository:
   - `AWS_ROLE_ARN`: ARN of IAM role with necessary permissions
   
2. The IAM role should have these permissions:
   - `lambda:UpdateFunctionCode`
   - `cloudshell:*`

## Monitoring and Verification

1. View scheduled tweets and logs:
```bash
./cloudshell-trigger.sh status
```

2. Check AWS CloudWatch Logs:
   - Go to AWS Console → CloudWatch → Log groups
   - Open `/aws/lambda/auto-tweet`
   - View most recent log stream

3. Verify scheduled tweets:
```bash
cat tweets.json | jq '.'
```

## Sample Commands
```bash
# Generate new tweets
./cloudshell-trigger.sh generate

# Check status and scheduled tweets
./cloudshell-trigger.sh status

# Post next tweet
./cloudshell-trigger.sh post
```
