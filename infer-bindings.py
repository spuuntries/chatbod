from llama_cpp import Llama, LlamaRAMCache
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
cache = LlamaRAMCache()
llm.set_cache(cache)


def generate(prompt):
    with open(os.environ["LLMCONFIG"], "rb") as f:
        llm_config = tomllib.load(f)
    output = llm(
        **llm_config["gen"],
        prompt=prompt,
    )

    # NOTE: Continue inference if we got cut off
    if output["choices"][0]["finish_reason"] == "length":
        return generate(prompt + output["choices"][0]["text"])
    return output["choices"][0]["text"]
