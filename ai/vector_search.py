import math
import re
from typing import List, Dict

# Standard English stop words
STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and", "any", "are", "arent", "as", "at",
    "be", "because", "been", "before", "being", "below", "between", "both", "but", "by", "cant", "cannot", "could",
    "couldnt", "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during", "each", "few", "for", "from",
    "further", "had", "hadnt", "has", "hasnt", "have", "havent", "having", "he", "hed", "hell", "hes", "her", "here",
    "heres", "hers", "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im", "ive", "if", "in",
    "into", "is", "isnt", "it", "its", "itself", "lets", "me", "more", "most", "mustnt", "my", "myself", "no", "nor",
    "not", "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves", "out", "over", "own",
    "same", "shant", "she", "shed", "shell", "shes", "should", "shouldnt", "so", "some", "such", "than", "that", "thats",
    "the", "their", "theirs", "them", "themselves", "then", "there", "theres", "these", "they", "theyd", "theyll",
    "theyre", "theyve", "this", "those", "through", "to", "too", "under", "until", "up", "very", "was", "wasnt", "we",
    "wed", "well", "were", "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which", "while",
    "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt", "you", "youd", "youll", "youre", "youve",
    "your", "yours", "yourself", "yourselves"
}

def tokenize(text: str) -> List[str]:
    """Lowercase text and split into clean alphanumeric words, excluding stop words."""
    words = re.findall(r"\b[a-zA-Z0-9_]+\b", text.lower())
    return [w for w in words if w not in STOP_WORDS]

def compute_tf(tokens: List[str]) -> Dict[str, float]:
    """Compute Term Frequency (TF) for a document."""
    tf = {}
    total = len(tokens)
    if total == 0:
        return tf
    for token in tokens:
        tf[token] = tf.get(token, 0) + 1
    # Normalize
    for token in tf:
        tf[token] = tf[token] / total
    return tf

def compute_idf(documents: List[List[str]]) -> Dict[str, float]:
    """Compute Inverse Document Frequency (IDF) across a small corpus."""
    idf = {}
    total_docs = len(documents)
    for doc in documents:
        unique_tokens = set(doc)
        for token in unique_tokens:
            idf[token] = idf.get(token, 0) + 1
            
    for token in idf:
        # standard log idf formula with smoothing
        idf[token] = math.log((1 + total_docs) / (1 + idf[token])) + 1
    return idf

def calculate_cosine_similarity(vec1: Dict[str, float], vec2: Dict[str, float]) -> float:
    """Calculates cosine similarity between two tf-idf vector dicts."""
    # Dot product
    dot_product = 0.0
    for key in vec1:
        if key in vec2:
            dot_product += vec1[key] * vec2[key]
            
    # Magnitudes
    mag1 = math.sqrt(sum(val ** 2 for val in vec1.values()))
    mag2 = math.sqrt(sum(val ** 2 for val in vec2.values()))
    
    if mag1 == 0.0 or mag2 == 0.0:
        return 0.0
        
    return dot_product / (mag1 * mag2)

def match_score(resume_text: str, job_description: str) -> float:
    """Returns a similarity match score between 0 and 100 using a TF-IDF Vector Space Model."""
    if not resume_text or not job_description:
        return 0.0
        
    resume_tokens = tokenize(resume_text)
    job_tokens = tokenize(job_description)
    
    # Corpus is just the pair of docs
    corpus = [resume_tokens, job_tokens]
    idf = compute_idf(corpus)
    
    # Compute TF-IDF Vectors
    resume_tf = compute_tf(resume_tokens)
    job_tf = compute_tf(job_tokens)
    
    resume_tfidf = {word: tf * idf.get(word, 1.0) for word, tf in resume_tf.items()}
    job_tfidf = {word: tf * idf.get(word, 1.0) for word, tf in job_tf.items()}
    
    similarity = calculate_cosine_similarity(resume_tfidf, job_tfidf)
    return round(similarity * 100, 1)
