# tree-kit Makefile
# Typed, serialisable tree structures for TypeScript.
# Zero runtime dependencies, zero UI framework.

.PHONY: help install build build-watch test test-watch test-coverage lint lint-fix \
        clean clean-all pack inspect publish publish-dry version-patch version-minor \
        version-major release-patch release-minor release-major link unlink \
        pre-release check-all

# Default
help: ## Show all targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Setup ----------------------------------------------------------

install: ## Install all dependencies
	npm install

# --- Build ----------------------------------------------------------

build: ## Build library (ESM + CJS + declarations)
	npm run build

build-watch: ## Build in watch mode
	npm run dev

# --- Quality --------------------------------------------------------

test: ## Run all tests
	npm run test

test-watch: ## Run tests in watch mode
	npm run test:watch

test-coverage: ## Run tests with coverage report
	npm run test:coverage

lint: ## Check linting (tsc + ESLint)
	npm run typecheck
	npm run lint

lint-fix: ## Fix linting errors
	npm run lint:fix

check-all: lint test build ## Run all checks (lint + test + build)
	@echo "All checks passed."

# --- Package --------------------------------------------------------

pack: build ## Create tarball without publishing
	npm pack

inspect: pack ## Show what would be published
	@echo ""
	@echo "Package contents:"
	@tar -tf astrapi69-tree-kit-*.tgz
	@echo ""
	@echo "Package size:"
	@ls -lh astrapi69-tree-kit-*.tgz
	@rm -f astrapi69-tree-kit-*.tgz

# --- Publish --------------------------------------------------------

publish-dry: build ## Dry run publish (shows what would happen)
	npm publish --dry-run --access public

publish: pre-release ## Publish to npm (runs all checks first)
	npm publish --access public
	@echo ""
	@echo "Published $$(node -p "require('./package.json').name")@$$(node -p "require('./package.json').version")"

pre-release: check-all inspect ## Run all pre-release checks
	@echo ""
	@echo "Pre-release checks passed. Ready to publish."

# --- Versioning -----------------------------------------------------

version-patch: ## Bump patch version (0.1.0 -> 0.1.1)
	npm version patch

version-minor: ## Bump minor version (0.1.0 -> 0.2.0)
	npm version minor

version-major: ## Bump major version (0.1.0 -> 1.0.0)
	npm version major

release-patch: version-patch ## Bump patch + push with tag
	git push origin main --tags

release-minor: version-minor ## Bump minor + push with tag
	git push origin main --tags

release-major: version-major ## Bump major + push with tag
	git push origin main --tags

# --- Local development (link to consuming apps) ---------------------

link: build ## Link package locally (for adaptive-learner / topos dev)
	npm link
	@echo ""
	@echo "Linked. In consuming app run:"
	@echo "  npm link @astrapi69/tree-kit"

unlink: ## Unlink local package
	npm unlink
	@echo ""
	@echo "Unlinked. In consuming app run:"
	@echo "  npm unlink @astrapi69/tree-kit"
	@echo "  npm install"

# --- Cleanup --------------------------------------------------------

clean: ## Remove build artifacts
	rm -rf dist/
	rm -f astrapi69-tree-kit-*.tgz
	@echo "Clean."

clean-all: clean ## Remove everything (including node_modules)
	rm -rf node_modules/
	@echo "Clean all."
