from llama_cpp import Llama, LlamaDiskCache
import random

llm = Llama(
    model_path="./models/13bpq/pyg.bin",
    seed=random.randint(1, 9999),
    n_ctx=2048,
    n_batch=512,
    n_threads=4,
    use_mlock=True,
    use_mmap=False,
)
cache = LlamaDiskCache(capacity_bytes=67108864)
llm.set_cache(cache)


def generate(prompt):
    output = llm(
        prompt,
        max_tokens=48,
        temperature=0.85,
        mirostat_mode=2,
        repeat_penalty=1.08,
        top_p=0.65,
    )
    if output["choices"][0]["finish_reason"] == "length":
        output["choices"][0]["text"] = output["choices"][0]["text"] + "—"
    return output["choices"][0]["text"]
