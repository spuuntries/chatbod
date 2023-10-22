from llama_cpp import Llama, LlamaDiskCache
from dotenv import load_dotenv
import random
import tomllib
import os

load_dotenv()
with open(os.environ["LLMCONFIG"], "rb") as f:
    llm_config = tomllib.load(f)

llm = Llama(
    **llm_config["init"],
    model_path=os.environ["MODELPATH"],
    seed=random.randint(1, 9999),
)


def generate(prompt, cid):
    cache = LlamaDiskCache(cache_dir=f".cache/llm_cache/{cid}", capacity_bytes=7 << 30)
    llm.set_cache(cache)

    with open(os.environ["LLMCONFIG"], "rb") as f:
        llm_config = tomllib.load(f)
    output = llm(
        **llm_config["gen"],
        prompt=prompt,
    )
    if output["choices"][0]["finish_reason"] == "length":
        output["choices"][0]["text"] = output["choices"][0]["text"] + "—"
    return output["choices"][0]["text"]
