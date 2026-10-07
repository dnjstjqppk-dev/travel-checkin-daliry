package main

import "testing"

func TestArticleFromInputNormalizesSlugAndPublication(t *testing.T) {
	article := articleFromInput(ArticleInput{
		Title: "  Test story  ",
		Slug: "  My Story  ",
		Category: "  Flights  ",
		Status: "published",
	})
	if article.Title != "Test story" {
		t.Fatalf("expected trimmed title, got %q", article.Title)
	}
	if article.Slug != "my-story" {
		t.Fatalf("expected normalized slug, got %q", article.Slug)
	}
	if article.Category != "flights" {
		t.Fatalf("expected normalized category, got %q", article.Category)
	}
	if article.PublishedAt == nil {
		t.Fatal("published article must have a publication timestamp")
	}

	punctuated := articleFromInput(ArticleInput{Title: "A/B & C!", Slug: "  A/B & C!  ", Category: "Flights", Status: "published"})
	if punctuated.Slug != "a-b-c" {
		t.Fatalf("expected punctuation slug, got %q", punctuated.Slug)
	}
	if punctuated.Category != "flights" {
		t.Fatalf("expected punctuation category slug, got %q", punctuated.Category)
	}

	unicode := articleFromInput(ArticleInput{Title: "한글 제목", Slug: "  한글 제목  ", Category: "hotels", Status: "draft"})
	if unicode.Slug != "한글-제목" {
		t.Fatalf("expected unicode slug, got %q", unicode.Slug)
	}

	draft := articleFromInput(ArticleInput{Slug: "draft", Category: "hotels", Status: "draft"})
	if draft.PublishedAt != nil {
		t.Fatal("draft article must not have a publication timestamp")
	}
}

func TestNormalizeSlugHandlesMixedCaseAndWhitespace(t *testing.T) {
	if got := normalizeSlug("  TRAVEL / NEWS  "); got != "travel-news" {
		t.Fatalf("expected normalized travel-news, got %q", got)
	}
	if got := normalizeSlug("_My__Article_"); got != "my-article" {
		t.Fatalf("expected normalized my-article, got %q", got)
	}
}