from llama_cpp import Llama
import random

llm = Llama(
    model_path="./models/7bq/ggml-model-q4_0-ggjt.bin",
    seed=random.randint(1, 9999),
    n_ctx=1024,
    use_mlock=True,
)


def generate(prompt):
    output = llm(prompt, max_tokens=64, temperature=0.75, stop=["<turn>"])
    return output["choices"][0]["text"]
