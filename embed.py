from sentence_transformers import SentenceTransformer, util
import json

embedder = SentenceTransformer("all-MiniLM-L12-v2")


def embed(prompt):
    return json.dumps(str(list(embedder.encode(prompt))))


def clamp(query, docs):
    query_emb = embedder.encode(query)
    doc_emb = embedder.encode(docs)

    scores = util.dot_score(query_emb, doc_emb)[0].cpu().tolist()

    doc_score_pairs = list(zip(docs, scores))

    doc_score_pairs = sorted(doc_score_pairs, key=lambda x: x[1], reverse=True)

    return json.dumps(
        [doc[0] for doc in list(filter(lambda x: x[1] >= 0.3, doc_score_pairs))][0:5]
    )
