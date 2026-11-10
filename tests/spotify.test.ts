import { describe, expect, test } from "vitest";
import { spotifyEmbedUrl } from "../src/utils/spotify";

describe("Spotify-spilleren på nettsiden", () => {
  test("en lenke til Spotify gir Spotify sin spiller", () => {
    expect(spotifyEmbedUrl("https://open.spotify.com/episode/4rOoJ6Egrf8K2IrywzwOMk?si=abc")).toBe("https://open.spotify.com/embed/episode/4rOoJ6Egrf8K2IrywzwOMk");
    expect(spotifyEmbedUrl("https://open.spotify.com/embed/show/5CfCWKI5pZ28U0uOzXkDHe")).toBe("https://open.spotify.com/embed/show/5CfCWKI5pZ28U0uOzXkDHe");
    expect(spotifyEmbedUrl("https://open.spotify.com/intl-no/track/11dFghVXANMlKmJXsNCbNl")).toBe("https://open.spotify.com/embed/track/11dFghVXANMlKmJXsNCbNl");
  });

  test("en adresse et annet sted legges aldri inn i siden, selv med /embed/ i seg", () => {
    for (const url of ["https://fremmed.example/embed/innlogging", "https://open.spotify.com.fremmed.example/embed/episode/abc", "javascript:alert(1)//open.spotify.com/episode/abc", "http://open.spotify.com/episode/abc", "", undefined]) {
      expect(spotifyEmbedUrl(url), String(url)).toBeNull();
    }
  });
});
