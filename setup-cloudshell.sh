#!/bin/bash

# AWS CLI credentials must be configured before running this script

# Upload the trigger script to CloudShell
aws cloudshell upload-file \
    --path ./cloudshell-trigger.sh \
    --name cloudshell-trigger.sh \
    --region ap-south-1

echo "Trigger script uploaded to CloudShell"
echo ""
echo "In CloudShell, run:"
echo "chmod +x cloudshell-trigger.sh"
echo "./cloudshell-trigger.sh [generate|post|both]"
