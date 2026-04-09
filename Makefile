SHELL := /bin/bash

ROOT_DIR := $(CURDIR)
VENV ?= .venv
PYTHON ?= python3
PNPM ?= pnpm
API_DIR := apps/api
PYTHON_BIN := $(ROOT_DIR)/$(VENV)/bin/python
PIP_BIN := $(ROOT_DIR)/$(VENV)/bin/pip
CELERY_BIN := $(ROOT_DIR)/$(VENV)/bin/celery
COMPOSE := docker compose -f docker-compose.infra.yml

.DEFAULT_GOAL := help

.PHONY: help dev-env dev-bootstrap dev-bootstrap-python dev-bootstrap-node \
	infra-up infra-down infra-logs dev-migrate dev-instance-bootstrap \
	dev-api dev-worker dev-beat dev-web dev-admin dev-space dev-live \
	dev-frontends

help:
	@printf '%s\n' 'Available targets:'
	@printf '  %-24s %s\n' 'dev-env' 'Create local .env files for host-run development'
	@printf '  %-24s %s\n' 'dev-bootstrap' 'Prepare env files, Python venv, and pnpm dependencies'
	@printf '  %-24s %s\n' 'dev-bootstrap-python' 'Create .venv and install backend dependencies'
	@printf '  %-24s %s\n' 'dev-bootstrap-node' 'Enable pnpm via corepack and install workspace packages'
	@printf '  %-24s %s\n' 'infra-up' 'Start PostgreSQL, Redis, RabbitMQ, and MinIO'
	@printf '  %-24s %s\n' 'infra-down' 'Stop local infrastructure services'
	@printf '  %-24s %s\n' 'infra-logs' 'Tail local infrastructure logs'
	@printf '  %-24s %s\n' 'dev-migrate' 'Run Django migrations with local settings'
	@printf '  %-24s %s\n' 'dev-instance-bootstrap' 'Register and configure the local Plane instance'
	@printf '  %-24s %s\n' 'dev-api' 'Run Django API on localhost:8000'
	@printf '  %-24s %s\n' 'dev-worker' 'Run Celery worker with local settings'
	@printf '  %-24s %s\n' 'dev-beat' 'Run Celery beat with local settings'
	@printf '  %-24s %s\n' 'dev-frontends' 'Run frontend dev servers via turbo'
	@printf '  %-24s %s\n' 'dev-web' 'Run web frontend on localhost:3000'
	@printf '  %-24s %s\n' 'dev-admin' 'Run admin frontend on localhost:3001'
	@printf '  %-24s %s\n' 'dev-space' 'Run space frontend on localhost:3002'
	@printf '  %-24s %s\n' 'dev-live' 'Run live server on localhost:3100'

dev-env:
	@[ -f .env ] || cp .env.host-run.example .env
	@[ -f apps/api/.env ] || cp apps/api/.env.host-run.example apps/api/.env
	@[ -f apps/web/.env ] || cp apps/web/.env.example apps/web/.env
	@[ -f apps/admin/.env ] || cp apps/admin/.env.example apps/admin/.env
	@[ -f apps/space/.env ] || cp apps/space/.env.example apps/space/.env
	@[ -f apps/live/.env ] || cp apps/live/.env.example apps/live/.env
	@if ! grep -q '^SECRET_KEY=' apps/api/.env; then \
		secret_key="$$(python3 -c "import secrets, string; alphabet = string.ascii_letters + string.digits; print(''.join(secrets.choice(alphabet) for _ in range(50)))")"; \
		printf 'SECRET_KEY="%s"\n' "$$secret_key" >> apps/api/.env; \
	fi
	@printf '%s\n' 'Host-run env files are ready.'

dev-bootstrap: dev-env dev-bootstrap-python dev-bootstrap-node

dev-bootstrap-python:
	$(PYTHON) -m venv $(VENV)
	$(PIP_BIN) install --upgrade pip setuptools wheel
	$(PIP_BIN) install -r $(API_DIR)/requirements/local.txt

dev-bootstrap-node:
	corepack enable pnpm
	$(PNPM) install

infra-up: dev-env
	$(COMPOSE) up -d

infra-down:
	$(COMPOSE) down

infra-logs:
	$(COMPOSE) logs -f

dev-migrate:
	cd $(API_DIR) && \
	$(PYTHON_BIN) manage.py migrate --settings=plane.settings.local

dev-instance-bootstrap:
	cd $(API_DIR) && \
	$(PYTHON_BIN) manage.py wait_for_db --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py wait_for_migrations --settings=plane.settings.local && \
	MACHINE_SIGNATURE="$$( \
			HOSTNAME="$$(hostname)"; \
			MAC_ADDRESS="$$(ip link show | awk '/ether/ {print $$2}' | head -n 1)"; \
			CPU_INFO="$$(cat /proc/cpuinfo 2>/dev/null)"; \
			MEMORY_INFO="$$(free -h 2>/dev/null)"; \
			DISK_INFO="$$(df -h 2>/dev/null)"; \
			printf '%s' "$$HOSTNAME$$MAC_ADDRESS$$CPU_INFO$$MEMORY_INFO$$DISK_INFO" | sha256sum | awk '{print $$1}' \
		)" && \
	$(PYTHON_BIN) manage.py register_instance "$$MACHINE_SIGNATURE" --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py configure_instance --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py create_bucket --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py clear_cache --settings=plane.settings.local

dev-api:
	cd $(API_DIR) && \
	$(PYTHON_BIN) manage.py wait_for_db --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py wait_for_migrations --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py runserver 0.0.0.0:8000 --settings=plane.settings.local

dev-worker:
	cd $(API_DIR) && \
	$(PYTHON_BIN) manage.py wait_for_db --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py wait_for_migrations --settings=plane.settings.local && \
	DJANGO_SETTINGS_MODULE=plane.settings.local $(CELERY_BIN) -A plane worker -l info

dev-beat:
	cd $(API_DIR) && \
	$(PYTHON_BIN) manage.py wait_for_db --settings=plane.settings.local && \
	$(PYTHON_BIN) manage.py wait_for_migrations --settings=plane.settings.local && \
	DJANGO_SETTINGS_MODULE=plane.settings.local $(CELERY_BIN) -A plane beat -l info

dev-frontends:
	$(PNPM) dev

dev-web:
	cd apps/web && $(PNPM) dev

dev-admin:
	cd apps/admin && $(PNPM) dev

dev-space:
	cd apps/space && $(PNPM) dev

dev-live:
	cd apps/live && $(PNPM) dev
