import ctranslate2
import os
import sentencepiece as spm

model_dir = "./models/o7bq/converted"

generator = ctranslate2.Generator(model_dir, device="auto", compute_type="auto")
sp = spm.SentencePieceProcessor(os.path.join(model_dir, "tokenizer.model"))


def generate(prompt):
    tokens = ["<s>"] + sp.encode(prompt, out_type=str)
    results = generator.generate_batch(
        [tokens],
        beam_size=1,
        sampling_temperature=0.8,
        sampling_topk=10,
        num_hypotheses=1,
        max_length=64,
        include_prompt_in_result=False,
    )
    return sp.decode(results[0].sequences_ids[0])
