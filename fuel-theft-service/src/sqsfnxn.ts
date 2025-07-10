import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient } from "./sqsClient";

export async function sendAlertMessage(payload: any) {
  const params = {
    QueueUrl: process.env.ALERT_QUEUE_URL!,
    MessageBody: JSON.stringify(payload),
  };

  await sqsClient.send(new SendMessageCommand(params));
  console.log("🚨 Alert message sent to SQS");
}

export async function sendReportMessage(payload: any) {
  const params = {
    QueueUrl: process.env.REPORT_QUEUE_URL!,
    MessageBody: JSON.stringify(payload),
  };

  await sqsClient.send(new SendMessageCommand(params));
  console.log("📄 Report message sent to SQS");
}
