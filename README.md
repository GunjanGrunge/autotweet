# AutoTweet

## CloudShell Usage

1. Open AWS CloudShell in your browser
2. Run the following commands:
```bash
chmod +x cloudshell-trigger.sh
./cloudshell-trigger.sh generate  # Generate new tweets
./cloudshell-trigger.sh post      # Post next scheduled tweet
./cloudshell-trigger.sh both      # Do both
```

## Setup Requirements

1. Add these secrets to your GitHub repository:
   - `AWS_ROLE_ARN`: ARN of IAM role with necessary permissions
   
2. The IAM role should have these permissions:
   - `lambda:UpdateFunctionCode`
   - `cloudshell:*`
