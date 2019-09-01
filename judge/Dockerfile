FROM golang:1.12 AS build-env
ADD . /src
WORKDIR /src
RUN go build src/main.go

FROM makarius/isabelle:Isabelle2019

USER root

COPY --from=build-env /src/main ./main
ENV ISABELLE_PATH=/home/isabelle/Isabelle/bin/isabelle
ENV SUBMISSION_FILE_PATH=/src/isabelle/Submitted.thy
ENTRYPOINT [ "./main" ]
