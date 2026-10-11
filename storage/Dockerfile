FROM golang:1.26.9-alpine AS build
ENV CGO_ENABLED=0 GOBIN=/out
RUN go install github.com/minio/minio@RELEASE.2025-10-15T17-29-55Z
FROM alpine:3.24
RUN apk add --no-cache ca-certificates && addgroup -S storage && adduser -S -G storage storage && mkdir /data && chown storage:storage /data
COPY --from=build /out/minio /usr/local/bin/minio
USER storage
EXPOSE 9000
ENTRYPOINT ["minio"]
