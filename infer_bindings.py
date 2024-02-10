from llama_cpp import Llama, LlamaDiskCache
from llama_cpp.llama_speculative import LlamaPromptLookupDecoding
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
    draft_model=LlamaPromptLookupDecoding(num_pred_tokens=2)
)

cache = LlamaDiskCache()
llm.set_cache(cache)


def generate(prompt):
    with open(os.environ["LLMCONFIG"], "rb") as f:
        llm_config = tomllib.load(f)
    output = llm(
        **llm_config["gen"],
        prompt=prompt,
    )
    if output["choices"][0]["finish_reason"] == "length":
        output["choices"][0]["text"] = output["choices"][0]["text"] + "—"
    return output["choices"][0]["text"]
