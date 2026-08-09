FROM docker.io/n8nio/n8n:latest

USER root
COPY workflows/ /home/node/workflows/
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
  && chown -R node:node /home/node/workflows

USER node
EXPOSE 5678
ENTRYPOINT ["/entrypoint.sh"]
