package main

import "testing"

func TestFontBlocks(t *testing.T) {
	css := []byte(`/* cyrillic */
@font-face {
  font-family: 'Alegreya Sans';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/alegreyasans/v24/a.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin-ext */
@font-face {
  font-family: 'Cinzel';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/cinzel/v23/b.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Cinzel';
  font-style: normal;
  font-weight: 500;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/cinzel/v23/c.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`)
	b := fontBlocks(css)
	if len(b) != 3 || string(b[1][1]) != "latin-ext" || string(b[2][1]) != "latin" {
		t.Fatalf("got %d", len(b))
	}
	if m := urlRe.FindSubmatch(b[2][0]); m == nil || string(m[1]) != "https://fonts.gstatic.com/s/cinzel/v23/c.woff2" {
		t.Fatal("url")
	}
}
