FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Mount or COPY your actual resume in at build/deploy time, e.g.:
#   COPY resume.pdf .
# or set RESUME_PATH to a mounted volume path.

CMD ["python", "main.py"]
