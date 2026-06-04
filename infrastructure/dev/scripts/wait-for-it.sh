#!/usr/bin/env bash
# Use this script to wait for a service to be ready before starting another one.
# Origin: https://github.com/vishnubob/wait-for-it

set -e

host="$1"
shift
cmd="$@"

until nc -z "$host" "${host#*:}"; do
  >&2 echo "Service at $host is unavailable - sleeping"
  sleep 1
done

>&2 echo "Service at $host is up - executing command"
exec $cmd
