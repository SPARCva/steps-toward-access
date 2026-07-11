# Go-live test checklist (run on a phone + a laptop)

## Team workflow
- [ ] Magic-link sign-in works for erica@, grants@, kat@, debi@ (Supabase
      redirect URL must include the app's /console URL)
- [ ] Non-roster email can sign in but sees "not on the team roster"
- [ ] Submit flow: camera opens, photo uploads on cell data, Continue is
      blocked until every photo has a description
- [ ] Kill the browser mid-draft → reopen → draft restored
- [ ] Queue: contributor sees only their own; editor sees all
- [ ] Review: request info → note visible to submitter; approve → converts
      to draft barrier with photos + Documented step; party matched/created
- [ ] Editor: place pin by clicking map; coordinates round-trip after save
- [ ] Publish/unpublish works for editors; audit log rows appear
      (Supabase Table Editor → access_audit_log)

## Public record
- [ ] Draft barriers are invisible on /map, /barrier/[id], /party/[id]
      (verify logged out / private window)
- [ ] Published barrier shows photos with alt text, paper trail, days-since
      counter, linked party page
- [ ] Map: zoom buttons and +/- keys; pins tabbable in order; Enter opens
      the barrier; list below matches pins exactly
- [ ] Keyboard-only pass: skip link first Tab; every control reachable;
      focus visible everywhere
- [ ] VoiceOver (iPhone) pass on /map and /report

## Visitor tool
- [ ] Address search returns picks; declining search still allows a letter
- [ ] "Help me say this" drafts from the description; edit box focused
- [ ] mailto opens mail app with subject+body; Copy copies; Print renders
      the dated letter layout
- [ ] Nothing typed appears in the database (spot-check tables)
