import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "./sqsClient";

const REPORT_QUEUE_URL = process.env.REPORT_QUEUE_URL!;

export async function pollReportQueue() {
  const command = new ReceiveMessageCommand({
    QueueUrl: REPORT_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10,
  });

  const response = await sqsClient.send(command);

  if (response.Messages && response.Messages.length > 0) {
    for (const msg of response.Messages) {
      console.log("📥 Received report message:", msg.Body);

                  // process here (e.g., generate PDF, update DB) our work here

      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: REPORT_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      }));
      console.log("✅ Report message deleted from SQS");
    }
  }
}









// Example IAM policy for SQS permissions
// This policy should be attached to the IAM role used by your microservices to receive messages from the SQS queue.

// {
//   "Effect": "Allow",
//   "Action": ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:GetQueueAttributes"],
//   "Resource": "arn:aws:sqs:your-region:your-account-id:queue-name"
// }
