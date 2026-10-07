package main

import "testing"

func TestArticleFromInputNormalizesSlugAndPublication(t *testing.T) {
	article := articleFromInput(ArticleInput{
		Title: "Test story",
		Slug: "  My Story  ",
		Category: "flights",
		Status: "published",
	})
	if article.Slug != "my-story" {
		t.Fatalf("expected normalized slug, got %q", article.Slug)
	}
	if article.PublishedAt == nil {
		t.Fatal("published article must have a publication timestamp")
	}

	draft := articleFromInput(ArticleInput{Slug: "draft", Category: "hotels", Status: "draft"})
	if draft.PublishedAt != nil {
		t.Fatal("draft article must not have a publication timestamp")
	}
}