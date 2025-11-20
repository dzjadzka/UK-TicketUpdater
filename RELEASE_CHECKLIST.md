# Release Checklist

Use this checklist before cutting a new release to ensure code quality and stability.

## Pre-Release Validation

### 1. Code Quality

- [ ] All linting passes: `npm run lint`
- [ ] Code is properly formatted: `npm run format:check`
- [ ] No console errors or warnings in output

### 2. Testing

- [ ] All tests pass: `npm test`
- [ ] Coverage is acceptable: `npm run test:coverage` (target: >50%)
- [ ] Manual smoke test of CLI: `npm run download:sample`
- [ ] Manual smoke test of API (if applicable):
  ```bash
  API_TOKEN=test npm run api
  curl -H "Authorization: Bearer test" http://localhost:3000/health
  ```

### 3. Dependencies

- [ ] Dependencies are up to date: `npm outdated`
- [ ] No known security vulnerabilities: `npm audit`
- [ ] `package-lock.json` is committed

### 4. Documentation

- [ ] README.md is up to date with new features
- [ ] CHANGELOG.md has entry for this version
- [ ] AGENTS.md reflects any workflow changes
- [ ] JSDoc comments are complete for new functions
- [ ] Environment variables documented

### 5. Configuration

- [ ] Sample config files are valid and up to date
- [ ] `.gitignore` properly excludes sensitive files
- [ ] CI workflow passes on main branch

### 6. Git Hygiene

- [ ] All changes committed with clear messages
- [ ] No sensitive data (credentials, tokens) in history
- [ ] Branch is up to date with base branch
- [ ] Version number updated in `package.json`

## Release Steps

1. **Update Version**

   ```bash
   npm version [major|minor|patch]  # Updates package.json and creates git tag
   ```

2. **Generate CHANGELOG Entry**
   - Summarize changes under new version heading
   - Include Added, Changed, Fixed, Removed sections as applicable

3. **Final Validation**

   ```bash
   npm ci                    # Clean install
   npm test                  # Run all tests
   npm run lint              # Check code quality
   ```

4. **Create GitHub Release**
   - Push tag: `git push --tags`
   - Create release on GitHub with notes from CHANGELOG
   - Attach any relevant artifacts

5. **Post-Release**
   - Verify CI passes on the tagged commit
   - Monitor for issues reported by users
   - Update deployment documentation if needed

## Rollback Plan

If critical issues are discovered after release:

1. Revert the release tag
2. Fix the issue in a new branch
3. Follow the release checklist again for a patch release
4. Communicate the issue and fix to users

## Support Channels

- GitHub Issues: Report bugs and request features
- Documentation: Refer users to README and CONTRIBUTING
- Security: Email maintainers privately for security issues
