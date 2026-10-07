FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/checkin-daily .
RUN CGO_ENABLED=0 go build -o /app/create-admin ./cmd/create-admin

FROM alpine:3.21
WORKDIR /app
COPY --from=build /app/checkin-daily ./checkin-daily
COPY --from=build /app/create-admin ./create-admin
ENV PORT=8080 SQLITE_PATH=/data/checkin-daily.db GIN_MODE=release
VOLUME ["/data"]
EXPOSE 8080
CMD ["./checkin-daily"]