import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "./sqsClient";

const ALERT_QUEUE_URL = process.env.ALERT_QUEUE_URL!;

export async function pollAlertQueue() {
  const command = new ReceiveMessageCommand({
    QueueUrl: ALERT_QUEUE_URL,
    MaxNumberOfMessages: 1,
    WaitTimeSeconds: 10, // long polling
  });

  const response = await sqsClient.send(command);

  if (response.Messages && response.Messages.length > 0) {
    for (const msg of response.Messages) {
      console.log("📥 Received alert message:", msg.Body);

                    // process it here (e.g., send push notification) our work here 

      // Delete message after processing
      await sqsClient.send(new DeleteMessageCommand({
        QueueUrl: ALERT_QUEUE_URL,
        ReceiptHandle: msg.ReceiptHandle!,
      }));
      console.log("✅ Alert message deleted from SQS");
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
