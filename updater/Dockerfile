FROM docker:cli
RUN apk add --no-cache git bash
COPY watch.sh /watch.sh
RUN chmod +x /watch.sh
ENTRYPOINT ["/watch.sh"]
