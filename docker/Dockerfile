FROM node:20-slim

# JDK 21 설치 (JetBrains 2024.3+ 플러그인 빌드용)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      wget apt-transport-https gnupg ca-certificates && \
    install -d /etc/apt/keyrings && \
    wget -qO /tmp/adoptium.asc https://packages.adoptium.net/artifactory/api/gpg/key/public && \
    gpg --dearmor -o /etc/apt/keyrings/adoptium.gpg < /tmp/adoptium.asc && \
    rm /tmp/adoptium.asc && \
    echo "deb [signed-by=/etc/apt/keyrings/adoptium.gpg] https://packages.adoptium.net/artifactory/deb $(. /etc/os-release && echo $VERSION_CODENAME) main" \
      > /etc/apt/sources.list.d/adoptium.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends temurin-21-jdk && \
    ln -s /usr/lib/jvm/temurin-21-jdk-$(dpkg --print-architecture) /usr/lib/jvm/temurin-21-jdk && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV JAVA_HOME=/usr/lib/jvm/temurin-21-jdk

WORKDIR /workspace
