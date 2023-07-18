from sentence_transformers import SentenceTransformer, util
import json

embedder = SentenceTransformer("all-MiniLM-L12-v2")
clamper = SentenceTransformer("multi-qa-mpnet-base-dot-v1")


def embed(prompt):
    return json.dumps(str(list(embedder.encode(prompt))))


def clamp(query, docs):
    query_emb = clamper.encode(query, normalize_embeddings=True)
    doc_emb = clamper.encode(docs, normalize_embeddings=True)

    scores = util.dot_score(query_emb, doc_emb)[0].cpu().tolist()

    doc_score_pairs = list(zip(docs, scores))

    doc_score_pairs = sorted(doc_score_pairs, key=lambda x: x[1], reverse=True)

    return json.dumps(
        [doc[0] for doc in list(filter(lambda x: x[1] >= 0.5, doc_score_pairs))][0:2]
    )
