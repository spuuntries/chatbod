from llama_cpp import Llama
import random

llm = Llama(
    model_path="./models/7bq/ggml-model-q4_0-ggjt.bin",
    seed=random.randint(1, 9999999),
    f16_kv=True,
    n_threads=3,
    last_n_tokens_size=32,
)


def generate(prompt):
    output = llm(prompt, max_tokens=32, temperature=0.75, top_p=0.7, stop=["\n"])
    return output["choices"][0]["text"]
