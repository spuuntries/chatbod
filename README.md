# 💬 Chatbod Engine: LlaMa-powered AI Companion

Chatbod Engine is the backend to kekbot's chatting module. Currently, its status is in _alpha_ due to lack of robust stability.

## 🛠️ Features

- Image captioning: Images sent to the bot are captioned to a textual representation, giving the bot pseudo-multimodal capabilities.
- Media-sending (experimental): The bot can send images via keywording and retrieving relevant medias. Currently only GIFs and AI-generated images are supported.
- Long-term memory: Memory is done via a summarization + context window shifting mechanism. (In-depth docs coming soon)
- $0 inference: All mechanisms are either done locally or via publicly-available APIs.

## ⏳ Performance

Performance currently depends on provider used for inference and length of current context window. Below listed are currently-known average performance of each provider:

- Petals: 1-2 mins.
- llama-cpp-python: 2-5 mins. (I/O overhead may contribute to this, we're bridging python to node.js via pythonia)
