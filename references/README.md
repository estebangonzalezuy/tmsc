# References

The club's working shelf of references: films, posts, sites, articles,
books, talks, studios, anything worth looking at twice. It is a scrapbook
for thinking, not a page on the site. Nothing here is built or deployed.

Collect loosely. Pick a few. Analyse them together. Keep the takeaways.

## The folders

```
references/
  INDEX.md        one row per reference, the list you scan and pick from
  inbox/          drop zone: uploads and links that haven't been filed yet
  items/          one card per reference (<id>.md, from _template.md)
  files/          the screenshots, PDFs and clips a card points at
  analyses/       one write-up per set you picked (from _analysis-template.md)
```

## The loop

1. **Drop.** Anything goes into `inbox/`: a screenshot, a PDF, a text
   file of links. No naming rules.
2. **File.** Each one becomes a card in `items/` and a row in `INDEX.md`.
   Its file moves to `files/` under the card's id (`files/<id>.png`,
   `files/<id>-2.png`…). The card says what it is, where it came from and
   why it was saved. The *why* is the one field that can't be skipped,
   because it's the thing you won't remember in three months.
3. **Pick.** Choose two to six references with a question in mind:
   "how do product launch films open?", "what makes this carousel read?".
   A pick with no question becomes a list rather than an analysis.
4. **Analyse.** One file in `analyses/` per set: the question, what each
   reference does, the patterns across them, and the takeaways for tMSC.
   The cards it used get `status: analysed` and a link back.

## The card

`id` is `YYYY-MM-<slug>` (month added plus a short name), and it is also
the file name and the prefix of its files. `type` comes from a short list
so the index stays sortable:

`film` · `post` · `carousel` · `reel` · `site` · `identity` · `article` ·
`book` · `talk` · `studio` · `tool` · `image` · `other`

`tags` are free, lower-case, hyphenated. `status` moves
`inbox → filed → picked → analysed`.

## How this sits beside the site

The Directory, the Stills and the Clips are the club's *published*
references: checked, credited, built into pages. This folder is the
step before that. When something here turns out to deserve a public home,
it graduates: a resource goes into a Directory TSV, a frame into the
Curator, a fragment into the Cutter. The card notes where it went.
