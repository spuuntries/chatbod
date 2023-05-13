// Function to process promises sequentially
async function processSequentially(promise) {
  // Wait for the promise to resolve
  const result = await promise;

  // Send the result back to the main thread
  self.postMessage(result);
}

// Message queue to store incoming promises
const messageQueue = [];

// Function to process the message queue
async function processMessageQueue() {
  while (messageQueue.length > 0) {
    const promise = messageQueue.shift();
    await processSequentially(promise);
  }
}

self.addEventListener("message", async (event) => {
  const promise = event.data;

  // Add the promise to the message queue
  messageQueue.push(promise);

  // Process the message queue
  await processMessageQueue();
});
