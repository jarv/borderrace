ls *.png | xargs -n1 -i convert -channel Alpha -evaluate Divide 4 {} trans_25/{} && ls *.png | xargs -n1 -i convert -channel Alpha -evaluate Divide 3 {} trans_33/{} && ls *.png | xargs -n1 -i convert -channel Alpha -evaluate Divide 2 {} trans_50/{}

