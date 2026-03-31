FROM golang:1.24-alpine AS backend-builder

WORKDIR /backend

# Copy only what the Go build and embed step need.
COPY go.mod main.go ./
COPY dist ./dist

# Ensure dependencies are resolved even when go.sum is absent.
RUN go mod tidy

# Build the application with the embedded static frontend.
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o douyin main.go

FROM alpine:latest

WORKDIR /app

RUN apk --no-cache add ca-certificates

COPY --from=backend-builder /backend/douyin ./
COPY --from=backend-builder /backend/dist ./dist

RUN mkdir -p media data

VOLUME /app/media

EXPOSE 8080

CMD ["./douyin", "--host", "0.0.0.0", "--static", "./dist", "--media", "./media"]
