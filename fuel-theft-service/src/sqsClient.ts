import { SQSClient } from "@aws-sdk/client-sqs";

export const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
  endpoint: process.env.AWS_SQS_ENDPOINT || "http://localhost:4566",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
});














// import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

// const sqsClient = new SQSClient({ region: "your-region" });

// export async function sendAlertMessage(alertPayload: any) {
//   const command = new SendMessageCommand({
//     QueueUrl: "https://sqs.your-region.amazonaws.com/your-account-id/fuel-alert-queue",
//     MessageBody: JSON.stringify(alertPayload),
//   });
//   await sqsClient.send(command);
// }

// export async function sendReportMessage(reportPayload: any) {
//   const command = new SendMessageCommand({
//     QueueUrl: "https://sqs.your-region.amazonaws.com/your-account-id/fuel-report-queue",
//     MessageBody: JSON.stringify(reportPayload),
//   });
//   await sqsClient.send(command);
// }








// Example IAM policy for SQS permissions
// This policy should be attached to the IAM role used by your microservices to send messages to the SQS queues. 

// {
//   "Effect": "Allow",
//   "Action": ["sqs:SendMessage"],
//   "Resource": [
//     "arn:aws:sqs:your-region:your-account-id:fuel-alert-queue",
//     "arn:aws:sqs:your-region:your-account-id:fuel-report-queue"
//   ]
// }
