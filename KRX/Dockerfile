FROM ubuntu:20.04

# Install dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    make \
    libmysqlclient-dev \
    libncurses5-dev libncursesw5-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Build the application
RUN make all

# Command to run the application
CMD ["make", "run"]