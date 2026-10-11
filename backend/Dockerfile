FROM golang:1.26.9-alpine AS build
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/backupcrypt ./cmd/backupcrypt
FROM alpine:3.24
RUN apk add --no-cache ca-certificates tzdata && addgroup -S crm && adduser -S crm -G crm
COPY --from=build /out/server /usr/local/bin/server
COPY --from=build /out/backupcrypt /usr/local/bin/backupcrypt
USER crm
ENV HTTP_ADDR=:8081 TZ=Asia/Aqtobe
EXPOSE 8081
ENTRYPOINT ["server"]
