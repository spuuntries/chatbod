from llama_cpp import Llama, LlamaDiskCache
import random

llm = Llama(
    model_path="./models/13bpq/pyg.bin",
    seed=random.randint(1, 9999),
    n_ctx=4096,
    n_batch=1024,
    n_threads=4,
    use_mlock=True,
    use_mmap=False,
    rope_freq_scale=0.5,
)
cache = LlamaDiskCache()
llm.set_cache(cache)


def generate(prompt):
    output = llm(
        prompt,
        max_tokens=48,
        temperature=0.9,
        mirostat_mode=2,
        repeat_penalty=1.08,
    )
    if output["choices"][0]["finish_reason"] == "length":
        output["choices"][0]["text"] = output["choices"][0]["text"] + "—"
    return output["choices"][0]["text"]
