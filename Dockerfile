FROM python:3.10-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY run.py .
COPY backend ./backend
# run.py listens on $PORT (Cloud Run sets it), defaulting to 8080.
ENV PORT=8080
EXPOSE 8080
CMD ["python", "run.py"]
