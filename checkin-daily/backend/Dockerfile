FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /app/checkin-daily .

FROM alpine:3.21
WORKDIR /app
COPY --from=build /app/checkin-daily ./checkin-daily
ENV PORT=8080 SQLITE_PATH=/data/checkin-daily.db GIN_MODE=release
VOLUME ["/data"]
EXPOSE 8080
CMD ["./checkin-daily"]