FROM node:0.12

MAINTAINER  Dezső BICZÓ "mxr576@gmail.com"

RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y git supervisor && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/mxr576/find-keywords-in-text.git fkit-api && \
  cd fkit-api && \
  npm install

ADD supervisord.conf /etc/supervisor/conf.d/supervisord.conf
ADD start.sh /start.sh

RUN chmod +x /start.sh

EXPOSE 9999

ENV GIT_BRANCH master
ENV NODE_LOG_LEVEL error

VOLUME ["/var/log/supervisor/"]

CMD ["/bin/bash", "-c", "/start.sh"]
