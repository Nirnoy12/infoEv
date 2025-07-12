# Use official Python image
FROM python:3.10-slim

# Set the working directory inside the container
WORKDIR /app

# Copy your project files into the container
COPY . /app

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Expose the port your app runs on
EXPOSE 5000

# Start the Flask app
CMD ["python", "app.py"] 