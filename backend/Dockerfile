# Use a lightweight Python base image
FROM python:3.10-slim

# Set working directory in the container
WORKDIR /backend

# Copy backend files
COPY . .

# Copy requirements.txt from parent directory
COPY ../requirements.txt /app/requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose Flask default port
EXPOSE 5000

# Run the Flask app
CMD ["python", "app.py"]
