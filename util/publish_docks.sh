# needs gh-pages
mkdocs build -f docs/mkdocs.yml
gh-pages -d docs/site
rm -rf docs/site