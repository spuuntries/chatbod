from llama_cpp import Llama
import random

llm = Llama(
    model_path="./models/13bpq/pyg.bin",
    seed=random.randint(1, 9999),
    n_ctx=2048,
    n_batch=512,
    use_mlock=True,
    use_mmap=False,
)


def generate(prompt):
    output = llm(
        prompt,
        max_tokens=64,
        temperature=0.85,
        mirostat_mode=2,
        repeat_penalty=1.08,
        top_p=0.65,
    )
    return output["choices"][0]["text"]
