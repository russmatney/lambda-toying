  # cd $SOME_FOLDER_THIS_RUNS_OUT_OF
  cd /Users/andrewlandry/Desktop/createMP4

  for f in *; do
    CODE=`basename $f`
    CODE=${CODE:0:11}
    echo $CODE

    # break apart the gif into frames
    mkdir ../working/$CODE
    /usr/local/bin/convert $f ../working/$CODE/$CODE.png

    # get the speed of the gif
    SPEED=`/usr/local/bin/identify -verbose $f`
    CUTPOINT="Delay: "
    SPEED=${SPEED#*${CUTPOINT}*}
    SPEED=${SPEED:0:2}
    SPEED=`expr 100 / $SPEED`
    echo "speed: " $SPEED

    cd ../working/$CODE

    FRAMES=0

    # get the number of frames
    for i in *; do
      FRAMES=`expr $FRAMES + 1`
    done
    echo "frames: " $FRAMES

    # rename for mp4 creation and create the files for it to loop five times
    # for (( j=0; j<=$FRAMES; j++ )); do
    for (( j=0; j<$FRAMES; j++ )); do
      echo "j:" $j
      k=`printf "%03d" $j`
      l=`expr $j + $FRAMES`
      l=`printf "%03d" $l`
      m=`expr $j + $FRAMES + $FRAMES`
      m=`printf "%03d" $m`
      n=`expr $j + $FRAMES + $FRAMES + $FRAMES`
      n=`printf "%03d" $n`
      o=`expr $j + $FRAMES + $FRAMES + $FRAMES + $FRAMES`
      o=`printf "%03d" $o`
      /usr/local/bin/convert $CODE-$j.png $CODE-$k.png
      /usr/local/bin/convert $CODE-$j.png $CODE-$l.png
      /usr/local/bin/convert $CODE-$j.png $CODE-$m.png
      /usr/local/bin/convert $CODE-$j.png $CODE-$n.png
      /usr/local/bin/convert $CODE-$j.png $CODE-$o.png
    done

    # make the gif into an mp4
    /usr/local/bin/ffmpeg -y -r $SPEED -i $CODE-%03d.png -c:v libx264 -pix_fmt yuv420p $CODE.mp4

    mv $CODE.mp4 ../../complete/$CODE.mp4

    cd ../../createMP4

    rm -r ../working/$CODE/

    rm $f

  done
