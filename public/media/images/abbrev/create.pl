#!/usr/bin/perl

#  ./create.pl 30 65 40

my ($f,$w,$h) = @ARGV;

my $th = $h - 5;
my @s = (
    "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "ID",
    "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI",
    "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY",
    "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
    "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", );
 
for (@s) {

    my $cmd = qq(convert -size ${w}x${h} xc:transparent -font Stripes-and-bubbles-Regular -pointsize $f -fill '#00006d' -draw 'text 1,$th "$_"' -trim $_.png);
    print $cmd . "\n";
    `$cmd`;
    $cmd = qq(convert -resize x${th} $_.png $_.png);
    print $cmd;
    `$cmd`;
}
