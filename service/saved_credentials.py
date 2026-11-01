"""Hosted credentials: server environment only; never returned to visitors."""
import os

def load():
    return {
        'booksKey': os.getenv('GOOGLE_BOOKS_API_KEY', ''),
        'geminiKey': os.getenv('GEMINI_API_KEY', ''),
        'model': os.getenv('GEMINI_MODEL', ''),
    }
